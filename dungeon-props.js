import {makePropSprite} from './prop-sprites.js?v=80eddf4efeb73b0f3ae528a5ccc41ada14f30f7a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=80eddf4efeb73b0f3ae528a5ccc41ada14f30f7a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
