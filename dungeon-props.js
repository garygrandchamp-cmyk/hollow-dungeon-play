import {makePropSprite} from './prop-sprites.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
