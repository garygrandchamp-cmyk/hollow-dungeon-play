import {makePropSprite} from './prop-sprites.js?v=f07b267ba3b378ae9cbde026bbf48f44495e778f';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=f07b267ba3b378ae9cbde026bbf48f44495e778f';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
