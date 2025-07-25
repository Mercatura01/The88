import MultiUserSystem "DiffUsers/DiffUsers";
import OrderedMap "mo:base/OrderedMap";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Text "mo:base/Text";
import Iter "mo:base/Iter";

import FileStorage "file-storage/file-storage";
import Http "file-storage/http";
import Blob "mo:base/Blob";


persistent actor {
    // Initialize the multi-user system state
    let multiUserState = MultiUserSystem.initState();

    // File storage for profile pictures and portfolios
    var storage = FileStorage.new();

    // User management functions
    public shared ({ caller }) func initializeAuth() : async () {
        MultiUserSystem.initializeAuth(multiUserState, caller);
    };

    public query ({ caller }) func getCurrentUserRole() : async MultiUserSystem.UserRole {
        MultiUserSystem.getUserRole(multiUserState, caller);
    };

    public query ({ caller }) func isCurrentUserAdmin() : async Bool {
        MultiUserSystem.isAdmin(multiUserState, caller);
    };

    public shared ({ caller }) func assignRole(user : Principal, newRole : MultiUserSystem.UserRole) : async () {
        MultiUserSystem.assignRole(multiUserState, caller, user, newRole);
    };

    public shared ({ caller }) func setApproval(user : Principal, approval : MultiUserSystem.ApprovalStatus) : async () {
        MultiUserSystem.setApproval(multiUserState, caller, user, approval);
    };

    public query ({ caller }) func getApprovalStatus() : async MultiUserSystem.ApprovalStatus {
        MultiUserSystem.getApprovalStatus(multiUserState, caller);
    };

    public query ({ caller }) func listUsers() : async [MultiUserSystem.UserInfo] {
        MultiUserSystem.listUsers(multiUserState, caller);
    };

    public type UserProfile = {
        name : Text;
        profilePicture : ?Text;
        portfolio : [Text];
    };

    transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    var userProfiles = principalMap.empty<UserProfile>();

    public query ({ caller }) func getUserProfile() : async ?UserProfile {
        principalMap.get(userProfiles, caller);
    };

    public shared ({ caller }) func saveUserProfile(profile : UserProfile) : async () {
        userProfiles := principalMap.put(userProfiles, caller, profile);
    };

    public query func listUserProfiles() : async [UserProfile] {
        Iter.toArray(principalMap.vals(userProfiles));
    };

    // File storage functions
    public shared ({ caller }) func uploadProfilePicture(path : Text, mimeType : Text, chunk : Blob, complete : Bool) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can upload profile pictures");
        };
        FileStorage.upload(storage, path, mimeType, chunk, complete);
    };

    public shared ({ caller }) func uploadPortfolioFile(path : Text, mimeType : Text, chunk : Blob, complete : Bool) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can upload portfolio files");
        };
        FileStorage.upload(storage, path, mimeType, chunk, complete);
    };

    public query func listFiles() : async [FileStorage.FileMetadata] {
        FileStorage.list(storage);
    };

    public query func http_request(request : Http.HttpRequest) : async Http.HttpResponse {
        FileStorage.fileRequest(storage, request, httpStreamingCallback);
    };

    public query func httpStreamingCallback(token : Http.StreamingToken) : async Http.StreamingCallbackHttpResponse {
        FileStorage.httpStreamingCallback(storage, token);
    };

    // Project and milestone types
    public type Milestone = {
        id : Nat;
        description : Text;
        deliverables : Text;
        amount : Nat;
        status : MilestoneStatus;
        amendmentRequests : Nat;
        reviewDeadline : ?Time.Time;
    };

    public type MilestoneStatus = {
        #pending;
        #inProgress;
        #completed;
        #underReview;
        #approved;
        #paymentReleased;
    };

    public type Project = {
        id : Nat;
        client : Principal;
        title : Text;
        description : Text;
        milestones : [Milestone];
        totalAmount : Nat;
        status : ProjectStatus;
        acceptedBid : ?Bid;
    };

    public type ProjectStatus = {
        #open;
        #inProgress;
        #completed;
        #disputed;
    };

    public type Bid = {
        provider : Principal;
        proposedTimeline : Text;
        terms : Text;
        amount : Nat;
    };

    // Project storage
    transient let natMap = OrderedMap.Make<Nat>(Int.compare);
    var projects = natMap.empty<Project>();
    var nextProjectId : Nat = 0;

    // Project management functions
    public shared ({ caller }) func createProject(title : Text, description : Text, milestones : [Milestone], totalAmount : Nat) : async Nat {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can create projects");
        };

        let projectId = nextProjectId;
        nextProjectId += 1;

        let project : Project = {
            id = projectId;
            client = caller;
            title = title;
            description = description;
            milestones = milestones;
            totalAmount = totalAmount;
            status = #open;
            acceptedBid = null;
        };

        projects := natMap.put(projects, projectId, project);
        projectId;
    };

    public query func getProject(projectId : Nat) : async ?Project {
        natMap.get(projects, projectId);
    };

    public query func listProjects() : async [Project] {
        Iter.toArray(natMap.vals(projects));
    };

    // Bidding functions
    public shared ({ caller }) func submitBid(projectId : Nat, proposedTimeline : Text, terms : Text, amount : Nat) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can submit bids");
        };

        switch (natMap.get(projects, projectId)) {
            case null { Debug.trap("Project not found") };
            case (?project) {
                if (project.status != #open) {
                    Debug.trap("Project not open for bidding");
                };

                let bid : Bid = {
                    provider = caller;
                    proposedTimeline = proposedTimeline;
                    terms = terms;
                    amount = amount;
                };

                let updatedProject = {
                    project with
                    acceptedBid = ?bid;
                };

                projects := natMap.put(projects, projectId, updatedProject);
            };
        };
    };

    // Milestone management functions
    public shared ({ caller }) func completeMilestone(projectId : Nat, milestoneId : Nat) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can complete milestones");
        };

        switch (natMap.get(projects, projectId)) {
            case null { Debug.trap("Project not found") };
            case (?project) {
                let updatedMilestones = Array.map<Milestone, Milestone>(
                    project.milestones,
                    func(m) {
                        if (m.id == milestoneId) {
                            {
                                m with
                                status = #underReview;
                                reviewDeadline = ?(Time.now() + 7 * 24 * 60 * 60 * 1_000_000_000);
                            };
                        } else {
                            m;
                        };
                    },
                );

                let updatedProject = {
                    project with
                    milestones = updatedMilestones;
                };

                projects := natMap.put(projects, projectId, updatedProject);
            };
        };
    };

    public shared ({ caller }) func requestAmendment(projectId : Nat, milestoneId : Nat) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can request amendments");
        };

        switch (natMap.get(projects, projectId)) {
            case null { Debug.trap("Project not found") };
            case (?project) {
                let updatedMilestones = Array.map<Milestone, Milestone>(
                    project.milestones,
                    func(m) {
                        if (m.id == milestoneId) {
                            if (m.amendmentRequests >= 2) {
                                Debug.trap("Maximum amendments reached");
                            };
                            {
                                m with
                                amendmentRequests = m.amendmentRequests + 1;
                                status = #inProgress;
                            };
                        } else {
                            m;
                        };
                    },
                );

                let updatedProject = {
                    project with
                    milestones = updatedMilestones;
                };

                projects := natMap.put(projects, projectId, updatedProject);
            };
        };
    };

    public shared ({ caller }) func approveMilestone(projectId : Nat, milestoneId : Nat) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can approve milestones");
        };

        switch (natMap.get(projects, projectId)) {
            case null { Debug.trap("Project not found") };
            case (?project) {
                let updatedMilestones = Array.map<Milestone, Milestone>(
                    project.milestones,
                    func(m) {
                        if (m.id == milestoneId) {
                            {
                                m with
                                status = #approved;
                            };
                        } else {
                            m;
                        };
                    },
                );

                let updatedProject = {
                    project with
                    milestones = updatedMilestones;
                };

                projects := natMap.put(projects, projectId, updatedProject);
            };
        };
    };

    public shared ({ caller }) func releasePayment(projectId : Nat, milestoneId : Nat) : async () {
        if (not (MultiUserSystem.hasPermission(multiUserState, caller, #user, true))) {
            Debug.trap("Unauthorized: Only approved users can release payments");
        };

        switch (natMap.get(projects, projectId)) {
            case null { Debug.trap("Project not found") };
            case (?project) {
                let updatedMilestones = Array.map<Milestone, Milestone>(
                    project.milestones,
                    func(m) {
                        if (m.id == milestoneId) {
                            switch (m.reviewDeadline) {
                                case null { Debug.trap("Milestone not under review") };
                                case (?deadline) {
                                    if (Time.now() < deadline) {
                                        Debug.trap("Review period not complete");
                                    };
                                    {
                                        m with
                                        status = #paymentReleased;
                                    };
                                };
                            };
                        } else {
                            m;
                        };
                    },
                );

                let updatedProject = {
                    project with
                    milestones = updatedMilestones;
                };

                projects := natMap.put(projects, projectId, updatedProject);
            };
        };
    };
};

