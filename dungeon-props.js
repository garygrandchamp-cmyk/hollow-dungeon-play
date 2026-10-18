import {makePropSprite} from './prop-sprites.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
