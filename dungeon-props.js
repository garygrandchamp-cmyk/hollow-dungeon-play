import {makePropSprite} from './prop-sprites.js?v=ed20d22aed165d3d0cb8addb592c83972073fd78';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=ed20d22aed165d3d0cb8addb592c83972073fd78';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
