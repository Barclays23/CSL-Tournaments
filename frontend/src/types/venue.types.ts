export interface Venue { _id:string; name:string; location:string|null; notes:string|null; status:"active"|"inactive"; createdAt:string; updatedAt:string; }
export interface VenueWrite { name:string; location?:string|null; notes?:string|null; }
