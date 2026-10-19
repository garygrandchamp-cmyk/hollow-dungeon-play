import {makePropSprite} from './prop-sprites.js?v=48c9690caaf071685197edd79934df66b444bc3a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=48c9690caaf071685197edd79934df66b444bc3a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
