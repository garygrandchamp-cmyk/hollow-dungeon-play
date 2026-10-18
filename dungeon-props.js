import {makePropSprite} from './prop-sprites.js?v=651dfa860b2dae38e46f50e1c461f45d3145b8c8';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=651dfa860b2dae38e46f50e1c461f45d3145b8c8';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
