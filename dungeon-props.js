import {makePropSprite} from './prop-sprites.js?v=b91d921906b17f837908fbc4821fb42dd44188f9';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b91d921906b17f837908fbc4821fb42dd44188f9';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
