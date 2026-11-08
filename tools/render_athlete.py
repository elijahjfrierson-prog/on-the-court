# Studio render of the generated athlete for previews: blender -b -P tools/render_athlete.py -- in.glb out.png
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x = 1200; sc.render.resolution_y = 1500
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.03, 0.03, 0.035, 1)
def light(name, loc, energy, size=2):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; o = bpy.data.objects.new(name, l); o.location = loc
    o.rotation_euler = (0, 0, 0); sc.collection.objects.link(o); c = o.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
tgt = bpy.data.objects.new('t', None); tgt.location = (0, 0, 1.0); sc.collection.objects.link(tgt)
light('key', (2.5, -3, 3), 900); light('rim', (-2.5, 2.5, 3), 700); light('fill', (-3, -2, 1.5), 250, 4)
cam = bpy.data.cameras.new('c'); cam.lens = 55; co = bpy.data.objects.new('c', cam); co.location = (1.6, -5.2, 1.25); sc.collection.objects.link(co); sc.camera = co
c = co.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('RENDERED', out)
