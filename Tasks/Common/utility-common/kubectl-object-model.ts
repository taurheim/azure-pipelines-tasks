import tl = require('vsts-task-lib/task');
import { IExecOptions, IExecSyncResult, IExecSyncOptions } from 'vsts-task-lib/toolrunner';

export interface Resource {
    name: string;
    type: string;
}

export class Kubectl {
    private kubectlPath: string;
    private namespace: string;

    constructor(kubectlPath: string, namespace?: string) {
        this.kubectlPath = kubectlPath;
        if (!!namespace) {
            this.namespace = namespace;
        }
        else {
            this.namespace = "default";
        }
    }

    public apply(configurationPaths: string | string[]): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("apply");
        command.arg(["-f", this.createInlineArray(configurationPaths)]);
        command.arg(["--namespace", this.namespace]);
        return command.execSync();
    }

    public annotate(resourceType: string, resourceName: string, annotations: string[], overwrite?: boolean): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("annotate");
        command.arg([resourceType, resourceName]);
        command.arg(["--namespace", this.namespace]);
        command.arg(annotations);
        if (!!overwrite) command.arg(`--overwrite`)
        return command.execSync();
    }

    public annotateFiles(files: string | string[], annotations: string[], overwrite?: boolean): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("annotate");
        command.arg(["-f", this.createInlineArray(files)]);
        command.arg(["--namespace", this.namespace]);
        command.arg(annotations);
        if (!!overwrite) command.arg(`--overwrite`)
        return command.execSync();
    }

    public describe(resourceType, resourceName, silent?: boolean): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("describe");
        command.arg([resourceType, resourceName]);
        command.arg(["--namespace", this.namespace]);
        return command.execSync({ silent: !!silent } as IExecOptions);
    }

    public getNewReplicaSet(deployment): string {
        let stdout = this.describe("deployment", deployment, true).stdout.split("\n");
        let newReplicaSet = "";
        stdout.forEach((line: string) => {
            if (!!line && line.toLowerCase().indexOf("newreplicaset") > -1) {
                newReplicaSet = line.substr(14).trim().split(" ")[0];
            }
        });

        return newReplicaSet;
    }

    public getAllPods(): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("get");
        command.arg("pods");
        command.arg(["--namespace", this.namespace]);
        command.arg(["-o", "json"])
        return command.execSync({ silent: true } as IExecSyncOptions);
    }

    public checkRolloutStatus(resourceType, name): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg(["rollout", "status"]);
        command.arg(resourceType + "/" + name);
        command.arg(["--namespace", this.namespace]);
        return command.execSync();
    }

    public getResources(applyOutput: string, filterResourceTypes: string[]): Resource[] {
        let outputLines = applyOutput.split("\n");
        let results = [];
        outputLines.forEach(line => {
            let words = line.split(" ");
            if (words.length > 2) {
                let resourceType = words[0].trim(), resourceName = JSON.parse(words[1].trim());
                if (filterResourceTypes.filter(type => !!type && resourceType.toLowerCase().startsWith(type.toLowerCase())).length > 0) {
                    results.push({
                        type: resourceType,
                        name: resourceName
                    } as Resource);
                }
            }
        });

        return results;
    }

    private createInlineArray(str: string | string[]): string {
        if (typeof str === "string") return str;
        return str.join(",");
    }
}