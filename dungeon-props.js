import {makePropSprite} from './prop-sprites.js?v=f414c9209e497cfc5d04552110a70457733840b0';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=f414c9209e497cfc5d04552110a70457733840b0';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
