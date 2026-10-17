import {makePropSprite} from './prop-sprites.js?v=1908281481c3818581fa62f1b68e946e615fba61';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=1908281481c3818581fa62f1b68e946e615fba61';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
