import {makePropSprite} from './prop-sprites.js?v=3bb31c2b0119d0819fb38cd81c6202ed8ba2819a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=3bb31c2b0119d0819fb38cd81c6202ed8ba2819a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
