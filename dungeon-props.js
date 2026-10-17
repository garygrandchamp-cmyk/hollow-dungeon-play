import {makePropSprite} from './prop-sprites.js?v=80b357f2bd55a10a9dd6b4b39394372730871214';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=80b357f2bd55a10a9dd6b4b39394372730871214';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
