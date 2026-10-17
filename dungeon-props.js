import {makePropSprite} from './prop-sprites.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
