import {makePropSprite} from './prop-sprites.js?v=c83e4d4daa13c7855e4b7f872c6ac80790f66cde';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=c83e4d4daa13c7855e4b7f872c6ac80790f66cde';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
