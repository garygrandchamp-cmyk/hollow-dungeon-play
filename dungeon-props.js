import {makePropSprite} from './prop-sprites.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
