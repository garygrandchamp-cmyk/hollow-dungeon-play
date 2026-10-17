import {makePropSprite} from './prop-sprites.js?v=f42ee60821f34db97d6fccc451cf9a7f80911c50';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=f42ee60821f34db97d6fccc451cf9a7f80911c50';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
