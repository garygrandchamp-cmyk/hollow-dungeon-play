import {makePropSprite} from './prop-sprites.js?v=679a6ce35ac41f2f93de327ed557392db4b515fe';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=679a6ce35ac41f2f93de327ed557392db4b515fe';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
