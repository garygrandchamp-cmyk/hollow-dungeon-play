import {makePropSprite} from './prop-sprites.js?v=0c65da45f24943a5281d437aefafb2de4949edc9';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=0c65da45f24943a5281d437aefafb2de4949edc9';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
