// models/User.js
import Model from '../lib/orm/Model.js';
import fields from './fields/index.js';

class Log extends Model {
    static tableName = 'log';

    // Use the domain‑specific field templates; you can override only `required` and `default`
    static fields = {
        path: new fields.PathField(),
        data: new fields.JsonField(),
    };

    // Define indexes if needed.
    static indexes = [

    ];
}

export default Log;
