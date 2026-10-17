import {makePropSprite} from './prop-sprites.js?v=3f0ffbf381cf1b61530dcf3d344db19a8e832b7d';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=3f0ffbf381cf1b61530dcf3d344db19a8e832b7d';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
