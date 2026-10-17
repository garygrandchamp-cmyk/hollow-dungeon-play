import {makePropSprite} from './prop-sprites.js?v=4bd264fda816e55230532703e5373771ce7389ce';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=4bd264fda816e55230532703e5373771ce7389ce';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
