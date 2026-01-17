from typing import Optional, Dict, Any


def extract_best_image_url(pin_data: Dict[str, Any]) -> Optional[str]:
    """
    Extract the best available image URL from a Pinterest pin response.
    
    Pinterest API v5 can have various schema variants. This function tries
    multiple paths to find the highest quality image URL.
    
    Args:
        pin_data: Raw pin data from Pinterest API
        
    Returns:
        Image URL or None if not found
    """
    # Try direct media field (v5 standard)
    if "media" in pin_data:
        media = pin_data["media"]
        
        # Try images object with various sizes
        if isinstance(media, dict) and "images" in media:
            images = media["images"]
            
            # Priority order: originals > largest size variants
            for size_key in ["originals", "orig", "original", "1200x", "600x", "400x", "236x"]:
                if size_key in images:
                    size_data = images[size_key]
                    if isinstance(size_data, dict) and "url" in size_data:
                        return size_data["url"]
        
        # Try direct URL in media
        if isinstance(media, dict) and "url" in media:
            return media["url"]
    
    # Try legacy image field
    if "image" in pin_data:
        image = pin_data["image"]
        
        if isinstance(image, dict):
            # Try standard sizes
            for size_key in ["original", "orig", "url"]:
                if size_key in image:
                    url = image[size_key]
                    if isinstance(url, str):
                        return url
        
        # Sometimes image is a direct URL string
        if isinstance(image, str):
            return image
    
    # Try images array (some variants)
    if "images" in pin_data:
        images = pin_data["images"]
        
        if isinstance(images, dict):
            for size_key in ["orig", "original", "1200x", "600x"]:
                if size_key in images and isinstance(images[size_key], dict):
                    if "url" in images[size_key]:
                        return images[size_key]["url"]
        
        # Sometimes it's a list
        if isinstance(images, list) and len(images) > 0:
            first_image = images[0]
            if isinstance(first_image, dict) and "url" in first_image:
                return first_image["url"]
            if isinstance(first_image, str):
                return first_image
    
    # Fallback: try image_large_url, image_medium_url, etc.
    for field in ["image_large_url", "image_medium_url", "image_small_url"]:
        if field in pin_data and isinstance(pin_data[field], str):
            return pin_data[field]
    
    return None
