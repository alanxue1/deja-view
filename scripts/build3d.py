import replicate
import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Set up Replicate API token
token = os.getenv("REPLICATE_API_TOKEN")
if not token:
    raise ValueError("Token not found! Make sure REPLICATE_API_TOKEN is set in .env")

# Replicate will use the token from environment variable automatically
# But we can also set it explicitly if needed
os.environ["REPLICATE_API_TOKEN"] = token

input_data = {
    "images": ["data:image/jpeg;base64,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"],
    "texture_size": 2048,
    "mesh_simplify": 0.9,
    "generate_model": True,
    "save_gaussian_ply": True,
    "ss_sampling_steps": 38
}

output = replicate.run(
    "firtoz/trellis:e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
    input=input_data
)

# Extract URLs from FileOutput objects
if isinstance(output, dict):
    result = {}
    for key, value in output.items():
        if hasattr(value, 'url'):
            result[key] = value.url  # Extract URL from FileOutput object
        else:
            result[key] = value
    print(result)
    
    # Get the model file URL
    if 'model_file' in result:
        model_url = result['model_file']
        print(f"\n🚀 Model URL: {model_url}")
    elif 'model_file' in output and hasattr(output['model_file'], 'url'):
        model_url = output['model_file'].url
        print(f"\n🚀 Model URL: {model_url}")
    else:
        print("\n⚠️  No model_file found in output")
        model_url = None
else:
    print(output)
    if hasattr(output, 'url'):
        model_url = output.url
        print(f"\n🚀 Model URL: {model_url}")
    else:
        model_url = None

# Download the model file if we have a URL
if model_url:
    print(f"\n⬇️  Downloading model file...")
    try:
        response = requests.get(model_url)
        response.raise_for_status()
        
        # Determine file extension from URL or content type
        if '.glb' in model_url or 'glb' in response.headers.get('content-type', ''):
            filename = "output_model.glb"
        elif '.ply' in model_url or 'ply' in response.headers.get('content-type', ''):
            filename = "output_model.ply"
        else:
            filename = "output_model.glb"  # Default to .glb
        
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"💾 Saved to '{filename}'")
    except Exception as e:
        print(f"❌ Error downloading file: {e}")
#=> {"model_file":"https://replicate.delivery/yhqm/5xOmxKPXDT...
