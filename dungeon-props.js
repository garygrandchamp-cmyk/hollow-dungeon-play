import {makePropSprite} from './prop-sprites.js?v=b258c395560209e8026ca4d5dec71424998d0de6';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b258c395560209e8026ca4d5dec71424998d0de6';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
