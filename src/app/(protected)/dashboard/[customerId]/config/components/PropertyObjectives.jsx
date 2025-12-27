import React from 'react';
import PropertyObjectivesTable from './PropertyObjectivesTable';

const PropertyObjectives = ({ objectives, onObjectivesChange }) => {
    return (
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Property Objectives</h5>
            <PropertyObjectivesTable objectives={objectives} onObjectivesChange={onObjectivesChange} />
        </div>
    );
};

export default PropertyObjectives;