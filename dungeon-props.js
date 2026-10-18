import {makePropSprite} from './prop-sprites.js?v=5ac77501c6c8fbc7bdffe3074112354f4264b8e7';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=5ac77501c6c8fbc7bdffe3074112354f4264b8e7';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
