import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility'
import { DeploymentType } from '../TaskParameters';
import { PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import { addReleaseAnnotation } from 'azurermdeploycommon/operations/ReleaseAnnotationUtility';
const oldRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP';
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE 1';
var deployUtility = require('azurermdeploycommon/webdeployment-common/utility.js');
var zipUtility = require('azurermdeploycommon/webdeployment-common/ziputility.js');

export class WindowsWebAppRunFromZipProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        var webPackage = this.taskParams.Package.getPath();
        
        if(this.taskParams.DeploymentType === DeploymentType.runFromZip) {
            var _isMSBuildPackage = await this.taskParams.Package.isMSBuildPackage();
            if(_isMSBuildPackage) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedformsbuildpackage"));
            }
            else if(this.taskParams.Package.getPackageType() === PackageType.war) {
                throw Error(tl.loc("Publishusingzipdeploydoesnotsupportwarfile"));
            }
        }

        if(tl.stats(webPackage).isDirectory()) {
            let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
            webPackage = await zipUtility.archiveFolder(webPackage, "", tempPackagePath);
            tl.debug("Compressed folder into zip " +  webPackage);
        }

        tl.debug("Initiated deployment via kudu service for webapp package : ");
        
        var addCustomApplicationSetting = ParameterParser.parse(runFromZipAppSetting);
        var deleteCustomApplicationSetting = ParameterParser.parse(oldRunFromZipAppSetting);
        var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(addCustomApplicationSetting, deleteCustomApplicationSetting);

        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }

        await this.kuduServiceUtility.deployUsingRunFromZip(webPackage, 
            { slotName: this.appService.getSlot() });

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
    }
}