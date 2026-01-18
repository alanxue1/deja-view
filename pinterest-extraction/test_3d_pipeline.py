#!/usr/bin/env python3
"""
End-to-end test script for the 3D model generation pipeline.

Flow:
1. Analyze Pinterest board to get pins and main item
2. Pick the first analyzed pin with a main item
3. Start a 3D extraction job for the main item
4. Poll until job completes
5. Report results

Usage:
    python3 test_3d_pipeline.py

Requirements:
    - Server running at http://localhost:8000
    - All API keys configured in .env
"""

import httpx
import time
import sys

# Configuration
BASE_URL = "http://localhost:8000"
BOARD_URL = "https://ca.pinterest.com/jlaxman2/home-decor/"
MAX_PINS = 1  # Only analyze a single pin
POLL_INTERVAL = 5  # Seconds between status polls
MAX_POLL_TIME = 300  # Maximum time to wait (5 minutes)


def log(message: str):
    """Print timestamped log message."""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def check_health():
    """Check if the server is running."""
    log("Checking server health...")
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{BASE_URL}/health")
            response.raise_for_status()
        log("✅ Server is healthy")
        return True
    except Exception as e:
        log(f"❌ Server health check failed: {e}")
        return False


def analyze_board():
    """Analyze Pinterest board and return pins with main item."""
    log(f"Analyzing board: {BOARD_URL}")
    log(f"  Max pins: {MAX_PINS}")

    with httpx.Client(timeout=300.0) as client:  # Board analysis can take a while (5 min)
        response = client.post(
            f"{BASE_URL}/v1/analyze",
            json={
                "board_url": BOARD_URL,
                "max_pins": MAX_PINS
            },
        )
        response.raise_for_status()
        data = response.json()
    
    log(f"✅ Board analyzed:")
    log(f"  Pins fetched: {data['num_pins_fetched']}")
    log(f"  Pins analyzed: {data['num_pins_analyzed']}")
    log(f"  Pins skipped: {data['num_pins_skipped']}")
    
    return data


def get_single_analyzed_pin(board_data):
    """Return the single analyzed pin (max_pins=1)."""
    pins = board_data.get("pins", [])
    if not pins:
        return None
    return pins[0]


def select_main_item(pin):
    """Select the main item from a pin analysis."""
    analysis = pin.get("analysis") or {}

    log("✅ Selected main item:")
    log(f"  Main item: {analysis.get('main_item')}")
    log(f"  Description: {(analysis.get('description') or '')[:80]}...")
    log(f"  Confidence: {analysis.get('confidence')}")

    return analysis


def start_3d_job(image_url: str, item_description: str):
    """Start a 3D extraction job."""
    log(f"Starting 3D extraction job...")
    log(f"  Image URL: {image_url}")
    log(f"  Item: {item_description}")

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{BASE_URL}/v1/extract-item-3d",
            json={
                "image_url": image_url,
                "item_description": item_description
            },
        )
        response.raise_for_status()
        data = response.json()
    
    job_id = data["job_id"]
    log(f"✅ Job started: {job_id}")
    
    return job_id


def poll_job_status(job_id: str):
    """Poll job status until completion or timeout."""
    log(f"Polling job status (max {MAX_POLL_TIME}s)...")
    
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < MAX_POLL_TIME:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{BASE_URL}/v1/extract-item-3d/{job_id}")
            response.raise_for_status()
            data = response.json()
        
        status = data["status"]
        
        if status != last_status:
            elapsed = int(time.time() - start_time)
            log(f"  Status: {status} ({elapsed}s elapsed)")
            last_status = status
        
        if status == "succeeded":
            log(f"✅ Job completed successfully!")
            return data
        
        if status == "failed":
            log(f"❌ Job failed: {data.get('error', 'Unknown error')}")
            return data
        
        if status == "expired":
            log(f"❌ Job expired")
            return data
        
        time.sleep(POLL_INTERVAL)
    
    log(f"❌ Timeout waiting for job completion")
    return None


def print_results(job_data):
    """Print the final results."""
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    if job_data["status"] != "succeeded":
        print(f"Job status: {job_data['status']}")
        if job_data.get("error"):
            print(f"Error: {job_data['error']}")
        return
    
    result = job_data["result"]
    
    print(f"Source Image: {result['source_image_url']}")
    print(f"Item Description: {result['item_description']}")
    print()
    print(f"📷 Extracted PNG URL:")
    print(f"   {result['result_image_url']}")
    print()
    print(f"🎮 3D Model GLB URL:")
    print(f"   {result['model_glb_url']}")
    print()
    print(f"R2 Keys:")
    print(f"   PNG: {result['result_image_r2_key']}")
    print(f"   GLB: {result['model_glb_r2_key']}")
    print("=" * 60)


def main():
    """Run the end-to-end test."""
    print("\n" + "=" * 60)
    print("3D Model Generation Pipeline Test")
    print("=" * 60 + "\n")
    
    # Step 1: Check server health
    if not check_health():
        log("Please start the server with: uvicorn app.main:app --reload --port 8000")
        sys.exit(1)
    
    print()
    
    # Step 2: Analyze board
    try:
        board_data = analyze_board()
    except Exception as e:
        log(f"❌ Board analysis failed: {e}")
        sys.exit(1)
    
    print()
    
    # Step 3: Use the single analyzed pin
    pin = get_single_analyzed_pin(board_data)
    if not pin:
        log("❌ No pins returned from analyze endpoint")
        sys.exit(1)

    if pin.get("skipped"):
        log(f"❌ Pin was skipped by analyzer: {pin.get('skip_reason', 'unknown reason')}")
        sys.exit(1)

    analysis = pin.get("analysis") or {}
    log("✅ Using single analyzed pin:")
    log(f"  Pin ID: {pin.get('pin_id')}")
    log(f"  Image URL: {pin.get('image_url')}")

    if not analysis.get("main_item"):
        log("❌ No main item detected in this pin. Re-run or increase MAX_PINS to try a different pin.")
        sys.exit(1)
    
    print()
    
    # Step 4: Select an item
    item = select_main_item(pin)
    
    print()
    
    # Step 5: Start 3D job
    try:
        job_id = start_3d_job(
            image_url=pin["image_url"],
            item_description=item["main_item"]  # Use simple identifier for better extraction
        )
    except Exception as e:
        log(f"❌ Failed to start 3D job: {e}")
        sys.exit(1)
    
    print()
    
    # Step 6: Poll for completion
    job_data = poll_job_status(job_id)
    if not job_data:
        sys.exit(1)
    
    # Step 7: Print results
    print_results(job_data)
    
    if job_data["status"] == "succeeded":
        print("\n✅ Pipeline test completed successfully!")
        print("\nYou can view the 3D model at:")
        print("   https://gltf-viewer.donmccurdy.com/")
        print(f"   Paste: {job_data['result']['model_glb_url']}")
    else:
        print("\n❌ Pipeline test failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
