import {makePropSprite} from './prop-sprites.js?v=30121f299882b406d928fe246006652b70636e05';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=30121f299882b406d928fe246006652b70636e05';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
