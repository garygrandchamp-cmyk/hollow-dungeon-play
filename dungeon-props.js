import {makePropSprite} from './prop-sprites.js?v=c9a9bc6ffe6f41314b36d0ecab8f6285887953ea';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=c9a9bc6ffe6f41314b36d0ecab8f6285887953ea';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
