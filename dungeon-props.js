import {makePropSprite} from './prop-sprites.js?v=d86935ebe9b35869980631b03fc74da6045ceda8';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=d86935ebe9b35869980631b03fc74da6045ceda8';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
