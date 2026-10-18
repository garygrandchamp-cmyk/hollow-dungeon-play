import {makePropSprite} from './prop-sprites.js?v=0b2a2cafb09c29e935e1f1032140ea48989343c5';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=0b2a2cafb09c29e935e1f1032140ea48989343c5';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
