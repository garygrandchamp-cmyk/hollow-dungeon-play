import {makePropSprite} from './prop-sprites.js?v=112c109deb93b220e4768f4656840e104866606b';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=112c109deb93b220e4768f4656840e104866606b';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
