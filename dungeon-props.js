import {makePropSprite} from './prop-sprites.js?v=9cd9b6e86f47bfdd3f9c26579aa4d1f076ab67a6';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=9cd9b6e86f47bfdd3f9c26579aa4d1f076ab67a6';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
