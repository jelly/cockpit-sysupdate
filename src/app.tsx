/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Card, CardHeader, CardTitle, CardBody } from "@patternfly/react-core/dist/esm/components/Card";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon/index.js";
import { Page, PageSection, } from "@patternfly/react-core/dist/esm/components/Page";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";
import { BugIcon, CheckIcon } from '@patternfly/react-icons';
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";

import cockpit from 'cockpit';

import { ListingTable } from "cockpit-components-table";

import { setFeatureEnabled, varlinkCall } from './client';

const _ = cockpit.gettext;

interface UpdateInfo {
    available: string;
}

interface Feature {
    id: string;
    description: string;
    documention: string[];
    enabled: boolean;
    suggest: boolean;
}

const SysUpdateStatus = ({ update_info }: { update_info: UpdateInfo | null }) => {
    const statusItems = [];

    if (update_info?.available) {
        statusItems.push({
            key: "update-available",
            icon: <Icon><BugIcon /></Icon>,
            message: cockpit.format(_("Update $0 available")),
        });
    } else {
        statusItems.push({
            key: "up-to-date",
            icon: <Icon status="success"><CheckIcon /></Icon>,
            message: _("System is up to date"),
        });
    }
    console.log(statusItems);

    return (
        <Card className="ct-card-info" id="sysupdate-status">
            <CardHeader>
                <CardTitle component="h2">{_("Status")}</CardTitle>
            </CardHeader>
            <CardBody>
                <List isPlain>
                    {statusItems.map(item => (
                        <ListItem key={item.key}>
                            <Flex spacer={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'nowrap' }}>
                                <FlexItem>{item.icon}</FlexItem>
                                <FlexItem>{item.message}</FlexItem>
                            </Flex>
                        </ListItem>
                    ))}
                </List>
            </CardBody>
        </Card>
    );
};

const SysUpdateConfiguration = () => {
    return (
        <Card className="ct-card-info" id="sysupdate-configuration">
            <CardHeader>
                <CardTitle component="h2">{_("Configuration")}</CardTitle>
            </CardHeader>
            <CardBody>
                <p>to be done</p>
            </CardBody>
        </Card>
    );
}


const SysUpdateFeatureList = () => {
    const [features, setFeatures] = useState<Feature[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFeatures = useCallback(() => {
        varlinkCall('io.systemd.SysUpdate.ListFeatures', { target: { class: "host" } })
            .then(({ features }) => setFeatures(features))
            .catch(err => {
                console.error("ListFeatures failed:", err.name, err.parameters);
                setFeatures([]);
                setError(err.message);
            });
    }, []);

    useEffect(loadFeatures, [loadFeatures]);

    const onSelect = (_event: unknown, isSelected: boolean, rowIndex: number) => {
        const feature = features?.[rowIndex];
        if (!feature || feature.enabled)
            return;
        setSelected(prev => {
            const next = new Set(prev);
            if (isSelected)
                next.add(feature.id);
            else
                next.delete(feature.id);
            return next;
        });
    };

    const apply = async () => {
        setApplying(true);
        setError(null);
        try {
            for (const id of selected)
                await setFeatureEnabled(id, true);
            setSelected(new Set());
        } catch (err) {
            setError(String(err));
        } finally {
            setApplying(false);
            loadFeatures();
        }
    };

    const applyButton = (
        <Button variant="primary"
                id="features-apply"
                isDisabled={selected.size === 0 || applying}
                isLoading={applying}
                onClick={apply}>
            {_("Apply")}
        </Button>
    );

    return (
        <Card id="features">
            <CardHeader actions={{ actions: applyButton }}>
                <CardTitle component="h2">{_("Features")}</CardTitle>
            </CardHeader>
            {error &&
                <CardBody>
                    <Alert variant="danger" isInline title={error} />
                </CardBody>}
            <ListingTable
                aria-label={_("Features")}
                loading={features === null ? _("Loading features…") : undefined}
                emptyCaption={_("No features available")}
                columns={[_("Name"), _("Description"), _("State")]}
                onSelect={onSelect}
                rows={(features ?? []).map(f => ({
                    props: { key: f.id },
                    selected: f.enabled || selected.has(f.id),
                    columns: [
                        { title: f.id },
                        { title: f.description },
                        { title: f.enabled ? _("Enabled") : _("Disabled") },
                    ],
                }))}
            />
        </Card>
    );
};

export const Application = () => {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    useEffect(() => {
        varlinkCall('io.systemd.SysUpdate.CheckNew', { target: { class: "host" } })
            .then(({ available }) => setUpdateInfo(available))
            .catch(err => {
                if (err?.name === "io.systemd.SysUpdate.NoUpdateNeeded")
                    setUpdateInfo(null);
                else
                    console.error("CheckNew failed:", err.name, err.parameters);
            });
    }, []);
    console.log("updateAvailable", updateInfo);

    return (
        <Page className='pf-m-no-sidebar'>
            <PageSection hasBodyWrapper={false} variant="secondary">
                <Gallery hasGutter className="ct-cards-grid">
                    <SysUpdateStatus update_info={updateInfo} />
                    <SysUpdateConfiguration />
                    <SysUpdateFeatureList />
                </Gallery>
            </PageSection>
        </Page>
    );
};
