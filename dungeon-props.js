import {makePropSprite} from './prop-sprites.js?v=befddde92486212af07f25756204766ad2950b0a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=befddde92486212af07f25756204766ad2950b0a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
