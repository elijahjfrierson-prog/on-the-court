# Run: ~/blender/blender -b --factory-startup=0 -P tools/make_athlete.py -- out.glb
# Builds a realistic CC0 MakeHuman athlete with MPFB2 (game_engine rig) and exports a skinned GLB.
import bpy, sys, os, addon_utils
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/athlete.glb'
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
macro = TargetService.get_default_macro_info_dict()
macro.update({'gender': 1.0, 'age': 0.5, 'muscle': 0.85, 'weight': 0.55, 'height': 0.95, 'proportions': 0.9})
macro['race'] = {'african': 0.9, 'asian': 0.0, 'caucasian': 0.1}
basemesh = HumanService.create_human(macro_detail_dict=macro, scale=0.1)
print('basemesh', basemesh.name, len(basemesh.data.vertices))
rig = HumanService.add_builtin_rig(basemesh, 'game_engine', import_weights=True)
print('rig', rig.name if rig else None, len(rig.data.bones) if rig else 0)
data = LocationService.get_mpfb_data('')
sysdata = LocationService.get_user_data('')
print('user data', sysdata, os.listdir(sysdata) if os.path.exists(sysdata) else 'missing')
def find(sub, ext):
    for root in [sysdata, data]:
        for d, _, files in os.walk(root):
            if sub in d:
                for f in files:
                    if f.endswith(ext): yield os.path.join(d, f)
skins = list(find('skins', '.mhmat')); print('skins', skins[:20])
pick = next((s for s in skins if 'young_african_male' in s.lower()), None) or next((s for s in skins if 'middleage_african_male' in s.lower()), skins[0] if skins else None)
if pick: HumanService.set_character_skin(pick, basemesh); print('skin', pick)
for kind in ['eyes', 'eyebrows', 'eyelashes', 'teeth', 'tongue', 'hair/short02']:
    c = list(find(kind, '.mhclo'))
    print(kind, c[:3])
    if c:
        try: HumanService.add_mhclo_asset(c[0], basemesh, asset_type='Bodypart' if kind != 'clothes' else 'Clothes', subdiv_levels=0)
        except Exception as e: print('fail', kind, e)
# bake shape keys first, then apply the helper mask so only the body is exported
for o in list(bpy.data.objects):
    if o.type != 'MESH': continue
    bpy.context.view_layer.objects.active = o
    if o.data.shape_keys:
        o.shape_key_add(name='final', from_mix=True)
        keys = list(o.data.shape_keys.key_blocks)
        for kb in keys[:-1]: o.shape_key_remove(kb)
        o.shape_key_remove(o.data.shape_keys.key_blocks[0])
    for m in list(o.modifiers):
        if m.type in ('MASK', 'SUBSURF'):
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as e: print('mod', e)
if rig: print('BONES', [b.name for b in rig.data.bones])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_apply=False, export_image_format='JPEG', export_jpeg_quality=85)
print('EXPORTED', out, os.path.getsize(out))
