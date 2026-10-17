import {makePropSprite} from './prop-sprites.js?v=d14ae9e96020f46d16650159fcf6f9538e196d06';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=d14ae9e96020f46d16650159fcf6f9538e196d06';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
