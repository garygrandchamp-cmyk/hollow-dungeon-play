import {makePropSprite} from './prop-sprites.js?v=ab1c3a2c3f50a1cc15eb7387806e39aa3043c1d7';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=ab1c3a2c3f50a1cc15eb7387806e39aa3043c1d7';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
