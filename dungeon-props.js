import {makePropSprite} from './prop-sprites.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
