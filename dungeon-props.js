import {makePropSprite} from './prop-sprites.js?v=637e9034956bdc32208d05c0403c280117b60bda';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=637e9034956bdc32208d05c0403c280117b60bda';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
