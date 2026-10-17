import {makePropSprite} from './prop-sprites.js?v=d4e934c03d90dda7229472246676281450a3dcd7';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=d4e934c03d90dda7229472246676281450a3dcd7';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
