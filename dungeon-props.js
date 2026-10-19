import {makePropSprite} from './prop-sprites.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
