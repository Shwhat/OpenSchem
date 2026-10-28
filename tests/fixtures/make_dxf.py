"""Builds the DXF files the import tests read (needs ezdxf: pip install ezdxf).

Each file holds a 20 ft x 12 ft room outline drawn in inches, with an arc, a circle, text and a block insert,
saved in a different DXF version so the importer is checked against R12, R2000 and R2018 files.
"""
import os
import ezdxf

HERE = os.path.dirname(os.path.abspath(__file__))


def build(version, name):
    doc = ezdxf.new(version, setup=True)
    doc.header['$INSUNITS'] = 1  # inches
    msp = doc.modelspace()
    doc.layers.add('WALLS', color=1)
    doc.layers.add('FURN', color=5)
    pts = [(0, 0), (240, 0), (240, 144), (0, 144)]
    if version == 'R12':
        msp.add_polyline2d(pts, close=True, dxfattribs={'layer': 'WALLS'})
    else:
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'WALLS'})
        # a polyline with a half circle (bulge 1) from (300, 0) to (300, 60)
        msp.add_lwpolyline([(300, 0, 0, 0, 1), (300, 60, 0, 0, 0)], format='xyseb')
        msp.add_ellipse((120, 200), major_axis=(30, 0), ratio=0.5)
        msp.add_spline_control_frame(fit_points=[(0, 220), (40, 260), (80, 220), (120, 260)])
        msp.add_mtext('Living room', dxfattribs={'insert': (60, 100), 'char_height': 8})
    msp.add_line((0, 72), (240, 72), dxfattribs={'linetype': 'DASHED' if version != 'R12' else 'CONTINUOUS'})
    msp.add_circle((120, 72), 18, dxfattribs={'layer': 'FURN'})
    msp.add_arc((240, 144), 36, 180, 270)
    msp.add_text('KITCHEN', dxfattribs={'insert': (20, 20), 'height': 6})
    blk = doc.blocks.new(name='TABLE')
    blk.add_line((-12, 0), (12, 0))
    blk.add_circle((0, 0), 6)
    msp.add_blockref('TABLE', (200, 40), dxfattribs={'rotation': 90, 'layer': 'FURN'})
    doc.saveas(os.path.join(HERE, name))


if __name__ == '__main__':
    build('R12', 'room-r12.dxf')
    build('R2000', 'room-r2000.dxf')
    build('R2018', 'room-r2018.dxf')
