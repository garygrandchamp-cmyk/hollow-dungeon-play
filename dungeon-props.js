import {makePropSprite} from './prop-sprites.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
