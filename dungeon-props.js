import {makePropSprite} from './prop-sprites.js?v=64ad63ccf9b715304e37145621288e4cb455ca14';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=64ad63ccf9b715304e37145621288e4cb455ca14';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
