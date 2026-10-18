import {makePropSprite} from './prop-sprites.js?v=b23c6bd9298aecfc45e3134840a59c28c03c1dce';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b23c6bd9298aecfc45e3134840a59c28c03c1dce';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
