import {makePropSprite} from './prop-sprites.js?v=e3a6ee50098f0c339207c14d31fb32c004d8491c';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=e3a6ee50098f0c339207c14d31fb32c004d8491c';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
