# Skybox System Guide

The skybox system supports three types of skyboxes: **Static**, **Random Static**, and **Animated**.

## Directory Structure

```
data/pngs/skybox/
├── SKYBOX_README.md         (this file)
├── space_nebula.png         (example static skybox - single file)
├── rebelinterior/           (example random static folder)
│   ├── interior1.png
│   ├── interior2.png
│   └── interior3.png
└── hyperspace/              (example animated folder)
    ├── frame_0001.png
    ├── frame_0002.png
    ├── frame_0003.png
    └── ...
```

## Skybox Types

### 1. Static Skybox (Single Image)
- **Format**: Single PNG or JPG file directly in `/data/pngs/skybox/`
- **Usage**: Always displays the same image
- **Example**: `space_nebula.png`, `hangar_bay.jpg`
- **Editor Selection**: Choose "Static" type, select the image file

### 2. Random Static Skybox (Pick Random from Folder)
- **Format**: Folder containing multiple PNG or JPG files
- **Usage**: Picks ONE random image from the folder when level loads
- **Example**: `rebelinterior/` folder with `interior1.png`, `interior2.png`, `interior3.png`
- **Behavior**: Each time the level loads, a different image may be selected
- **Editor Selection**: Choose "Random Static" type, select the folder name

### 3. Animated Skybox (Cycle Through Frames)
- **Format**: Folder containing multiple PNG or JPG files (typically numbered)
- **Usage**: Cycles through all images in the folder like animation frames
- **Example**: `hyperspace/` folder with `frame_0001.png`, `frame_0002.png`, etc.
- **Frame Rate**: 24 FPS (configurable in `skybox_animator.js`)
- **Behavior**: Continuously loops through all images in alphabetical order
- **Editor Selection**: Choose "Animated" type, select the folder name

## Image Requirements

- **Format**: PNG or JPG
- **Recommended Resolution**: 2048x1024 or 4096x2048 (equirectangular panorama)
- **Mapping**: Images should be equirectangular 360° panoramas (2:1 aspect ratio)
- **Color Space**: sRGB encoding (automatically applied)

## Level Editor Usage

1. Open the level editor (`GonkLevelEditor.html`)
2. Click the "skybox" layer button
3. Select skybox type:
   - **None**: No skybox (transparent/null background)
   - **Static**: Single image file
   - **Random Static**: Random image from folder
   - **Animated**: Cycle through images in folder
4. Choose the specific file/folder from the dropdown
5. Changes are saved in the level JSON

## Level JSON Format

```json
{
  "settings": {
    "defaults": {
      "skybox": {
        "key": "space_nebula"
      }
    }
  },
  "layers": {
    "skybox": [
      [
        "0,0",
        {
          "key": "hyperspace",
          "properties": {
            "type": "animation"
          }
        }
      ]
    ]
  }
}
```

### Type Values:
- `"type": "static"` - Single static image
- `"type": "random_static"` - Pick random from folder
- `"type": "animation"` - Animated sequence
- `"type": "none"` or `"key": null` - No skybox

## Fallback Behavior

If a skybox fails to load (missing files, invalid path):
- Console warning is displayed
- Scene background falls back to dark blue color (`0x000011`)
- Game continues normally without crashing

## Tips

- **Performance**: Animated skyboxes with many frames may impact performance. Keep frame counts reasonable (30-60 frames max).
- **File Size**: Compress skybox images to reduce load times. Use JPG for photographic content, PNG for stylized art.
- **Naming**: For animated sequences, use numbered filenames (`frame_0001.png`, `frame_0002.png`) to ensure correct order.
- **Random Static Use Case**: Perfect for levels where you want variety but not animation (e.g., different ship interiors, various planet views).

## Current Status (2025-11-15)

The skybox directory is currently empty. To use skyboxes:
1. Add your skybox image files to `/data/pngs/skybox/`
2. For folders (random_static or animation), create subdirectories
3. The system will auto-discover all files/folders on level load
4. Use the level editor to assign skyboxes to levels

## Example Setup

To create a simple test:
1. Add `test.png` (any 2:1 panorama image) to `/data/pngs/skybox/`
2. In editor, select "Static" and choose "test.png"
3. Save level and test in game
